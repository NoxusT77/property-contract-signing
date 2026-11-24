import { signPropertyContract } from './contract_service.ts';
import { InfraiClient } from './infrai_client.ts';

const input = {
  tenantId: process.env.TENANT_ID ?? 'tenant-demo',
  propertyId: process.env.PROPERTY_ID ?? 'property-demo',
  pdfBase64: process.env.CONTRACT_PDF_BASE64 ?? '',
  certPem: process.env.SIGNING_CERT_PEM ?? '',
  keyPem: process.env.SIGNING_KEY_PEM ?? ''
};
const result = await signPropertyContract(input, new InfraiClient(), process.env.INFRAI_BUCKET ?? 'property-contracts');
console.log(JSON.stringify(result, null, 2));
