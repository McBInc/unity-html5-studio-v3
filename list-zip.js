const fs = require('fs');
const JSZip = require('jszip');

async function checkZip() {
    try {
        const data = fs.readFileSync('Dragon_Crashers_WebGL.zip');
        const zip = await JSZip.loadAsync(data);
        console.log("ZIP Contents:");
        zip.forEach((relativePath, file) => {
            console.log(relativePath);
        });
    } catch (e) {
        console.error("Failed to read zip:", e);
    }
}
checkZip();
