import { Publisher, Routes } from '@mahonen_consulting_zlc/common';
import type { ExpirationCompleteEvent } from '@mahonen_consulting_zlc/common';

class ExpirationCompletePublisher extends Publisher<ExpirationCompleteEvent> {
    protected readonly route = Routes.EXPIRATION_COMPLETE;
}

export const expirationCompletePublisher = new ExpirationCompletePublisher();
