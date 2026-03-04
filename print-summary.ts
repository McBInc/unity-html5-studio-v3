import fs from "fs";

const r = JSON.parse(fs.readFileSync('./mega-test-out.json', 'utf8'));

for (let zip in r) {
    console.log('\n=== ' + zip + ' ===');
    for (let p in r[zip]) {
        const raw = r[zip][p];
        if (raw.error) {
            console.log('  ' + p.padEnd(20) + '| ERROR: ' + raw.error);
        } else {
            let key = p.toLowerCase().replace('_games', '').replace('_playables', '');
            if (raw[key] && raw[key].score !== undefined) {
                console.log('  ' + p.padEnd(20) + '| Score: ' + raw[key].score);
            } else {
                console.log('  ' + p.padEnd(20) + '| Scanned Successfully (Check JSON for details)');
            }
        }
    }
}
