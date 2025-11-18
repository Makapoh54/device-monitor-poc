import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import sortKeys from 'sort-keys';

type ChecksumInput = string | { [key: string]: any };

function toChecksumBuffer(data: ChecksumInput): Buffer {
  if (typeof data === 'string') {
    return Buffer.from(data, 'utf8');
  }

  const sorted = sortKeys(data, { deep: true });
  return Buffer.from(JSON.stringify(sorted), 'utf8');
}

function md5WithOpenSSL(data: ChecksumInput): Promise<string> {
  return new Promise((resolve, reject) => {
    const normalized = toChecksumBuffer(data);
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

function md5WithNodeCrypto(data: ChecksumInput): string {
  const normalized = toChecksumBuffer(data);
  const hash = createHash('md5');
  hash.update(normalized);
  return hash.digest('hex');
}

@Injectable()
export class ChecksumService {
  async checksum(data: ChecksumInput): Promise<string> {
    try {
      return await md5WithOpenSSL(data);
    } catch {
      return md5WithNodeCrypto(data);
    }
  }

  async verifyChecksum(
    data: ChecksumInput,
    expected: string,
  ): Promise<boolean> {
    const digest = await this.checksum(data);
    return digest.toLowerCase() === expected.toLowerCase();
  }
}
