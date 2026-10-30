import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ENDPOINT = 'catalog:public-endpoint';
/** Only approved public queries may opt out of default denial. */
export const PublicEndpoint = () => SetMetadata(PUBLIC_ENDPOINT, true);
