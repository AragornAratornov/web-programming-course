type Props = { filled: number; total: number };

export function ProgressBar({ filled, total }: Props) {
  return (
    <p>
      Прогресс: {filled} / {total}
    </p>
  );
}