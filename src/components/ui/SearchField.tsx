import type { InputHTMLAttributes } from "react";

type SearchFieldProps = {
  label: string;
  name: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "name">;

export function SearchField({ label, name, ...inputProps }: SearchFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"
        {...inputProps}
      />
    </label>
  );
}
