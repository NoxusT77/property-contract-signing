import assert from 'node:assert/strict';
import { signPropertyContract } from './contract_service.ts';

const calls: string[] = [];
const client = {
  sign: async () => { calls.push('sign'); return { pdf: 'signed-pdf' }; },
  putObject: async (_bucket: string, key: string) => { calls.push(`put:${key}`); },
  presign: async (_bucket: string, key: string) => { calls.push(`link:${key}`); return { url: 'https://download.example/contracts/demo.pdf' }; }
} as any;
const result = await signPropertyContract({ tenantId: 't-7', propertyId: 'p-2', pdfBase64: 'pdf', certPem: 'cert', keyPem: 'key' }, client, 'property-contracts');
assert.equal(result.objectKey, 'contracts/p-2/t-7.pdf');
assert.deepEqual(calls, ['sign', 'put:contracts/p-2/t-7.pdf', 'link:contracts/p-2/t-7.pdf']);
console.log('contract decision test passed');
