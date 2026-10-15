type Props = {
  prompt: string;
  code?: string;
  text: string;
  onChange: (text: string) => void;
};

export function ShortTextForm({ prompt, code, text, onChange }: Props) {
  return (
    <div>
      <label>
        {prompt}
        {code && <pre>{code}</pre>}
        <textarea value={text} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}