import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);

  return parts.filter(Boolean).map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      if (/^(https?:\/\/|mailto:)/i.test(url)) {
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[#F5C542] underline underline-offset-2"
          >
            {label}
          </a>
        );
      }
      return label;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function RichText({ value }: { value: string }) {
  if (!value.trim()) return null;

  const lines = value.split(/\r?\n/);
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const HeadingTag = heading[1].length === 1 ? "h3" : "h4";
      blocks.push(
        <HeadingTag key={index} className="font-semibold text-[#EEF2FF]">
          {renderInline(heading[2])}
        </HeadingTag>,
      );
      index += 1;
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (listMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(
          ordered ? /^\d+\.\s+(.+)$/ : /^[-*]\s+(.+)$/,
        );
        if (!item) break;
        items.push(<li key={index}>{renderInline(item[1])}</li>);
        index += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={`list-${index}`}
          className={ordered ? "list-inside list-decimal" : "list-inside list-disc"}
        >
          {items}
        </ListTag>,
      );
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${index}`} className="whitespace-pre-wrap">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
  }

  return <div className="space-y-2 text-sm leading-6 text-[#9FB0E6]">{blocks}</div>;
}
