// Contact for the "talk to a consultant" CTA in generated reports.
// Override with VITE_CONSULTING_PHONE (E.164, e.g. +919876543210).
export const CONSULTING_NAME = 'Vineet'

export const CONSULTING_PHONE: string =
  (import.meta.env.VITE_CONSULTING_PHONE as string | undefined) ??
  '+918451049570'

export const CONSULTING_WHATSAPP_URL = `https://wa.me/${CONSULTING_PHONE.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
  'Hi Vineet, I just ran a CAIO business report and would like a consultation.',
)}`
