/** A small pulsing red-pen dot that marks something as live. */
export function LiveDot() {
  return (
    <span className="relative flex size-2.5" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex size-2.5 rounded-full bg-live" />
    </span>
  )
}
