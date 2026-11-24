import React from 'react';

interface WhatsAppTextProps {
  text: string;
}

function renderInlineFormatting(line: string, lineIdx: number): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const pattern = /(\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    const raw = match[0];
    const inner = raw.slice(1, -1);
    const key = `${lineIdx}-${partIdx++}`;
    if (raw.startsWith('*')) {
      tokens.push(
        <strong key={key} className="font-semibold text-slate-900">
          {inner}
        </strong>
      );
    } else if (raw.startsWith('_')) {
      tokens.push(
        <em key={key} className="italic text-slate-700">
          {inner}
        </em>
      );
    } else {
      tokens.push(
        <code key={key} className="rounded bg-slate-900/8 px-1 py-0.5 font-mono text-[12px] text-slate-800">
          {inner}
        </code>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens;
}

export const WhatsAppText: React.FC<WhatsAppTextProps> = ({ text }) => {
  const blocks = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-1 text-[13.5px] leading-[1.45] text-slate-800 break-words">
      {blocks.map((block, bIdx) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          const code = block.slice(3, -3).trim();
          return (
            <pre
              key={bIdx}
              className="my-1.5 overflow-x-auto rounded-md bg-slate-900 px-3 py-2 font-mono text-[12px] text-slate-100"
            >
              <code>{code}</code>
            </pre>
          );
        }

        const lines = block.split('\n');
        return (
          <div key={bIdx} className="space-y-0.5">
            {lines.map((line, lIdx) => {
              if (!line.trim()) {
                return <div key={lIdx} className="h-1.5" />;
              }
              return <div key={lIdx}>{renderInlineFormatting(line, lIdx)}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
};
