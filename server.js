
const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

app.post('/convert', upload.single('video'), (req, res) => {
    const { fps = 10, scale = '1200:-1' } = req.body;
    const inputPath = req.file.path;
    const tempPalette = `${Date.now()}-palette.png`;
    const outputName = `${Date.now()}.gif`;
    const outputPath = path.join(__dirname, 'public', outputName);

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
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(tempPalette);
                    res.json({ gifUrl: `http://localhost:${port}/${outputName}` });
                })
                .on('error', (err) => {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(tempPalette);
                    res.status(500).send('FFmpeg error: ' + err.message);
                });
        })
        .on('error', (err) => {
            fs.unlinkSync(inputPath);
            res.status(500).send('Palette generation error: ' + err.message);
        });
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
