// Minimal Razorpay checkout.js loader + types. The script is injected on
// demand the first time a purchase is started.

export type RazorpaySuccessResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }
  handler: (response: RazorpaySuccessResponse) => void
  modal?: { ondismiss?: () => void }
}

type RazorpayInstance = {
  open: () => void
  on: (
    event: 'payment.failed',
    handler: (response: {
      error: { description?: string; reason?: string }
    }) => void,
  ) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

let loader: Promise<void> | null = null

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loader = null
      reject(new Error('Could not load the payment window. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return loader
}

export function openRazorpayCheckout(options: RazorpayOptions) {
  if (!window.Razorpay) {
    throw new Error('Payment window is not ready yet')
  }
  const instance = new window.Razorpay(options)
  return instance
}
