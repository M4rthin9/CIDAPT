// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Error {
      code: string;
      message_th: string;
      message_en: string;
    }
    interface Locals {
      lang: 'th' | 'en';
    }
    interface PageData {
      lang: 'th' | 'en';
    }
  }
}

export {};
