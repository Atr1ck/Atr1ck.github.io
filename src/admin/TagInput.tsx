import { useMemo, useState } from "react";
import { normalizeTagList, titleCaseTag } from "../../shared/tags";

export default function TagInput({ value, suggestions, onChange }: { value: string[]; suggestions: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const normalized = normalizeTagList(value);
  const options = useMemo(() => suggestions.filter((tag) => !normalized.includes(tag) && tag.toLowerCase().includes(draft.trim().toLowerCase())).slice(0, 8), [draft, normalized, suggestions]);
  const add = (raw: string) => {
    const tag = titleCaseTag(raw);
    if (tag && !normalized.includes(tag)) onChange([...normalized, tag]);
    setDraft("");
  };
  return <div className="relative rounded-md border border-base-300 bg-base-100 px-2 py-1.5 focus-within:border-primary">
    <div className="flex flex-wrap items-center gap-1.5">
      {normalized.map((tag) => <button type="button" key={tag} className="badge badge-outline cursor-pointer rounded px-2 py-3 text-xs" onClick={() => onChange(normalized.filter((item) => item !== tag))}>{tag} ×</button>)}
      <input className="min-w-28 flex-1 bg-transparent px-1 py-1 text-sm outline-none" value={draft} placeholder="输入标签，回车添加" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(draft); } if (event.key === "Backspace" && !draft && normalized.length) onChange(normalized.slice(0, -1)); }} onBlur={() => { if (draft.trim()) add(draft); }} />
    </div>
    {draft.trim() && options.length > 0 && <div className="absolute left-2 right-2 top-full z-20 mt-1 flex flex-wrap gap-1 border border-base-300 bg-base-100 p-2 shadow-lg">{options.map((tag) => <button type="button" className="btn btn-ghost btn-xs rounded" key={tag} onMouseDown={(event) => event.preventDefault()} onClick={() => add(tag)}>{tag}</button>)}</div>}
  </div>;
}
