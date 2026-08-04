const fs = require('fs');

const updateFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');

  // Insertar la funcion handleDownloadAnimation justo antes de useEffect(() => { if (!user) ... })
  if (!content.includes('handleDownloadAnimation')) {
    const fn = `
  const handleDownloadAnimation = async () => {
    try {
      const displayMediaOptions = {
        video: { displaySurface: "browser" },
        audio: false
      };
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 100);

      let mimeType = 'video/webm;codecs=vp9';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
          mimeType = 'video/mp4;codecs=avc1';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
      const chunks = [];
      
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`animacion-productos.mp4\`;
        a.click();
        URL.revokeObjectURL(url);
        setIsPlaying(false);
      };

      recorder.start();
      
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
          stream.getTracks().forEach(t => t.stop());
        }
      }, 9500);
      
    } catch (err) {
      console.log("Grabación cancelada o no soportada:", err);
    }
  };
`;
    content = content.replace(/  useEffect\(\(\) => \{\n    if \(\!user\) \{/g, fn + '\n  useEffect(() => {\n    if (!user) {');
  }

  // Insertar el boton de descarga a la par del boton de Play
  if (!content.includes('Descargar animación (MP4)')) {
    const playBtnRegex = /<button\s+onClick=\{\(\) => setIsPlaying\(\!isPlaying\)\}[\s\S]*?<\/button>/;
    const match = content.match(playBtnRegex);
    if (match) {
      const playBtn = match[0];
      const downloadBtn = `
            {/* Download Button */}
            <button
              onClick={handleDownloadAnimation}
              className="p-2.5 rounded-2xl border-2 transition-all shadow-sm flex items-center justify-center flex-shrink-0 group bg-white border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-500/30"
              title="Descargar animación (MP4)"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
            </button>`;
      content = content.replace(playBtnRegex, playBtn + downloadBtn);
    }
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}

updateFile('./pages/Store.tsx');
updateFile('./pages/Dashboard.tsx');
