import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

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

    quill.root.innerHTML = value || '';

    const handleTextChange = () => {
      const html = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;
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
  }, [formats, modules, placeholder, value]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) {
      return;
    }

    const normalizedValue = value || '';
    const currentHtml = quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML;
    if (currentHtml !== normalizedValue) {
      const selection = quill.getSelection();
      quill.root.innerHTML = normalizedValue;
      if (selection) {
        quill.setSelection(selection);
      }
    }
  }, [value]);

  return (
    <div
      sx={{}}
      style={{
        marginBottom: '60px',
      }}
    >
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