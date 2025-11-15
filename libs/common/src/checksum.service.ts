import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type Normalizable = string | Buffer | { [key: string]: any } | any[];

function sortJsonValue(value: any): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item)) as JsonValue;
  }

  if (value !== null && typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const result: { [key: string]: JsonValue } = {};
    for (const key of sortedKeys) {
      const v = value[key];
      if (v === undefined) continue;
      result[key] = sortJsonValue(v);
    }
    return result;
  }

  return value as JsonPrimitive;
}

function normalizeDataForHash(data: Normalizable): Buffer {
  if (Buffer.isBuffer(data)) return data;

  if (data !== null && typeof data === 'object') {
    const sorted = sortJsonValue(data);
    return Buffer.from(JSON.stringify(sorted), 'utf8');
  }

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      const sorted = sortJsonValue(parsed);
      return Buffer.from(JSON.stringify(sorted), 'utf8');
    } catch {
      return Buffer.from(data, 'utf8');
    }
  }

  return Buffer.from(String(data), 'utf8');
}

function md5WithOpenSSL(data: Normalizable): Promise<string> {
  return new Promise((resolve, reject) => {
    const normalized = normalizeDataForHash(data);
    const child = spawn('openssl', ['md5']);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => reject(error));

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.length > 0 ? stderr : `openssl md5 exited with code ${code}`,
          ),
        );
        return;
      }

      const parts = stdout.split('=');
      if (parts.length < 2) {
        reject(new Error(`Unexpected openssl md5 output: "${stdout.trim()}"`));
        return;
      }

      const digest = parts[1].trim();
      resolve(digest);
    });

    child.stdin.write(normalized);
    child.stdin.end();
  });
}

function md5WithNodeCrypto(data: Normalizable): string {
  const normalized = normalizeDataForHash(data);
  const hash = createHash('md5');
  hash.update(normalized);
  return hash.digest('hex');
}

@Injectable()
export class ChecksumService {
  async checksum(data: Normalizable): Promise<string> {
    try {
      return await md5WithOpenSSL(data);
    } catch {
      return md5WithNodeCrypto(data);
    }
  }

  async verifyChecksum(data: Normalizable, expected: string): Promise<boolean> {
    const digest = await this.checksum(data);
    return digest.toLowerCase() === expected.toLowerCase();
  }
}
