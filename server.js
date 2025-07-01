const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000; // Railway uses dynamic ports

// Middlewares
app.use(cors());
app.use(express.static('public'));

// Multer setup
const upload = multer({ dest: 'uploads/' });

// Endpoint to convert video to GIF
app.post('/convert', upload.single('video'), (req, res) => {
    const fps = parseInt(req.body.fps) || 10;
    const scale = req.body.scale || '1200:-1';

    const inputPath = req.file?.path;
    const tempPalette = `${Date.now()}-palette.png`;
    const outputName = `${Date.now()}.gif`;
    const outputPath = path.join(__dirname, 'public', outputName);

    // Debug logs
    console.log('📥 File received:', req.file);
    console.log('🎞 FPS:', fps);
    console.log('📐 Scale:', scale);

    if (!inputPath) {
        return res.status(400).send('No video file provided.');
    }

    // Step 1: Generate palette
    ffmpeg(inputPath)
        .outputOptions([
            `-vf fps=${fps},scale=${scale}:flags=lanczos,palettegen`,
        ])
        .save(tempPalette)
        .on('end', () => {
            // Step 2: Use palette to create high-quality GIF
            ffmpeg(inputPath)
                .input(tempPalette)
                .complexFilter([
                    `fps=${fps},scale=${scale}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=none`
                ])
                .outputOptions(['-loop 0'])
                .save(outputPath)
                .on('end', () => {
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(tempPalette)) fs.unlinkSync(tempPalette);
                    res.json({ gifUrl: `${req.protocol}://${req.get('host')}/${outputName}` });
                })
                .on('error', (err) => {
                    console.error('❌ FFmpeg error:', err.message);
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(tempPalette)) fs.unlinkSync(tempPalette);
                    res.status(500).send('FFmpeg error: ' + err.message);
                });
        })
        .on('error', (err) => {
            console.error('❌ Palette generation error:', err.message);
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            res.status(500).send('Palette generation error: ' + err.message);
        });
});

// FFmpeg test route (optional)
app.get('/ffmpeg-check', (req, res) => {
    const { exec } = require('child_process');
    exec('ffmpeg -version', (err, stdout, stderr) => {
        if (err) return res.status(500).send('FFmpeg not working');
        res.send(stdout);
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
