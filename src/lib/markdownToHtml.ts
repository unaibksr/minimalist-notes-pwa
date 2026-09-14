export const markdownToHtml = (text: string): string => {
  const lines = text.split('\n');
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  const inline = (line: string): string => {
    line = line.replace(/`([^`]+)`/g, '<code>$1</code>');
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
    return line;
  };

  const closeLists = () => {
    if (inUl) { result.push('</ul>'); inUl = false; }
    if (inOl) { result.push('</ol>'); inOl = false; }
  };

  for (const line of lines) {
    if (/^### /.test(line)) {
      closeLists();
      result.push(`<h3>${inline(line.replace(/^### /, ''))}</h3>`);
    } else if (/^## /.test(line)) {
      closeLists();
      result.push(`<h2>${inline(line.replace(/^## /, ''))}</h2>`);
    } else if (/^# /.test(line)) {
      closeLists();
      result.push(`<h1>${inline(line.replace(/^# /, ''))}</h1>`);
    } else if (/^- /.test(line)) {
      if (!inUl) { result.push('<ul>'); inUl = true; }
      if (inOl) { result.push('</ol>'); inOl = false; }
      result.push(`<li>${inline(line.replace(/^- /, ''))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (!inOl) { result.push('<ol>'); inOl = true; }
      if (inUl) { result.push('</ul>'); inUl = false; }
      result.push(`<li>${inline(line.replace(/^\d+\. /, ''))}</li>`);
    } else if (/^> /.test(line)) {
      closeLists();
      result.push(`<blockquote>${inline(line.replace(/^> /, ''))}</blockquote>`);
    } else if (line.trim() === '') {
      closeLists();
    } else {
      closeLists();
      result.push(`<p>${inline(line)}</p>`);
    }
  }

  closeLists();

  return result.join('');
};

export const hasMarkdown = (text: string): boolean =>
  /(^#|\*\*|__|\*|_|- |\d+\. |```|> )/m.test(text);
