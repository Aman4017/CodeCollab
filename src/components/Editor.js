import React, { useEffect, useRef, useState } from 'react';
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike'; // C, C++, Java
import { Socket } from 'socket.io-client';
import ACTIONS from '../Actions';

// import '../codemirrors/lib/codemirror.css';


const languageModes = {
  python: 'python',
  java: 'text/x-java',
  cpp: 'text/x-c++src',
  c: 'text/x-csrc'
};

const Editor = ({ socketRef, roomId, onCodeChange }) => {
  const editorRef = useRef(null);
  const textareaRef = useRef(null);
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  useEffect(() => {
    if (editorRef.current) {
      // If an editor instance already exists, do nothing
      return;
    }

    const init = () => {
      editorRef.current = Codemirror.fromTextArea(textareaRef.current, {
        mode: languageModes[selectedLanguage],
        theme: 'dracula',
        autoCloseTags: true,
        autoCloseBrackets: true,
        lineNumbers: true,
      });

      editorRef.current.on('change', (instance, changes) => {
        const { origin } = changes;
        const code = instance.getValue();
        onCodeChange(code);
        if (origin !== 'setValue') {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code,
          });
        }
      });
    };

    init();

    // Cleanup function to destroy the editor instance when the component unmounts
    return () => {
      if (editorRef.current) {
        editorRef.current.toTextArea();
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null) {
          editorRef.current.setValue(code);
        }
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.CODE_CHANGE);
      }
    };
  }, [socketRef.current]);

  // Effect to update CodeMirror mode based on selected language
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setOption('mode', languageModes[selectedLanguage]);
    }
  }, [selectedLanguage]);

  const handleCompile = async () => {
    const code = editorRef.current.getValue();
    console.log(selectedLanguage);
    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/editor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, input, language: selectedLanguage })
    });

    const data = await response.json();
    setOutput(data.output);
  };

  return (
    <div >
      <select className='editor-container'
        onChange={(e) => setSelectedLanguage(e.target.value)}
        value={selectedLanguage}
      >
        <option value="python">Python</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
        <option value="c">C</option>
      </select>
      <button className='btn runBtn' onClick={handleCompile}>
        Compile <img src="/play.png" alt="" className='runImg' />
      </button>
      <textarea ref={textareaRef} id="realtimeEditor" className='write-code-area'></textarea>
      <div className='code-runner'>
        <div className="input">
          <label htmlFor="Input">Input</label>
          <textarea
            className='runner-text-area'
            value={input}
            onChange={(e) => setInput(e.target.value)}
          ></textarea>
        </div>
        <div className="output">
          <label htmlFor="Input">Output</label>
          <textarea
            className='runner-text-area'
            value={output}
            readOnly
          ></textarea>
        </div>
      </div>
    </div>
  );
};

export default Editor;
