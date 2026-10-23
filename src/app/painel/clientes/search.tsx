export function SearchBox({ q, placeholder }: { q?: string; placeholder: string }) {
  return (
    <form className="mb-4">
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="h-10 w-full max-w-sm rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
      />
    </form>
  );
}
