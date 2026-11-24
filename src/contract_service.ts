import { z } from 'zod';
import { InfraiClient } from './infrai_client.ts';

export const contractRequest = z.object({
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  pdfBase64: z.string().min(1),
  certPem: z.string().min(1),
  keyPem: z.string().min(1)
});
export type ContractRequest = z.infer<typeof contractRequest>;

export async function signPropertyContract(input: unknown, client: InfraiClient, bucket: string) {
  const request = contractRequest.parse(input);
  const signed = await client.sign(request.pdfBase64, request.certPem, request.keyPem);
  const objectKey = `contracts/${request.propertyId}/${request.tenantId}.pdf`;
  await client.putObject(bucket, objectKey, signed.pdf ?? '');
  const link = await client.presign(bucket, objectKey, 900);
  return { tenantId: request.tenantId, propertyId: request.propertyId, objectKey, downloadUrl: link.url, signed };
}
