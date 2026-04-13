import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const EMPTY_EDITOR_HTML = '<p><br></p>';

const getEditorHtml = (quill) => {
  const html = quill.root.innerHTML;
  return html === EMPTY_EDITOR_HTML ? '' : html;
};

const applyHtmlToEditor = (quill, html) => {
  if (!html) {
    quill.setText('');
    return;
  }

  quill.clipboard.dangerouslyPasteHTML(0, html, 'silent');
};

const restoreSelection = (quill, selection) => {
  if (!selection) {
    return;
  }

  const editorLength = quill.getLength();
  const nextIndex = Math.min(Math.max(selection.index ?? 0, 0), Math.max(editorLength - 1, 0));
  const maxLength = Math.max(editorLength - nextIndex - 1, 0);
  const nextLength = Math.min(Math.max(selection.length ?? 0, 0), maxLength);

  try {
    quill.setSelection(nextIndex, nextLength, 'silent');
  } catch (error) {
    const fallbackIndex = Math.max(quill.getLength() - 1, 0);
    quill.setSelection(fallbackIndex, 0, 'silent');
  }
};

const RichTextEditor = ({
  value = '',
  onChange,
  modules,
  formats,
  placeholder = 'Start writing…',
  minHeight = 450,
}) => {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || quillRef.current) {
      return undefined;
    }

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      modules,
      formats,
      placeholder,
    });

    applyHtmlToEditor(quill, value || '');

    const handleTextChange = () => {
      const html = getEditorHtml(quill);
      if (typeof onChangeRef.current === 'function') {
        onChangeRef.current(html);
      }
    };

    quill.on('text-change', handleTextChange);
    quillRef.current = quill;

    return () => {
      quill.off('text-change', handleTextChange);
      quillRef.current = null;
    };
  }, [formats, modules, placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) {
      return;
    }

    const normalizedValue = value || '';
    const currentHtml = getEditorHtml(quill);
    if (currentHtml !== normalizedValue) {
      const selection = quill.getSelection();

      applyHtmlToEditor(quill, normalizedValue);
      restoreSelection(quill, selection);
    }
  }, [value]);

  return (
    <div style={{ marginBottom: '60px' }}>
      <div
        ref={containerRef}
        style={{
          minHeight,
        }}
      />
    </div>
  );
};

export default RichTextEditor;