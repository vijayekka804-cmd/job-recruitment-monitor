const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
  try {
    const url = 'http://web.archive.org/web/20250417213825/https://vyapamcg.cgstate.gov.in/Post?PostID=Recruitment%20Year%20Wise';
    console.log('Fetching year-wise page:', url);
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
    const $ = cheerio.load(res.data);
    const outputLines = [];

    outputLines.push('PAGE TITLE: ' + $('title').text().trim());

    console.log('\n--- Printing all links on year-wise page ---');
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (href.includes('Posts') || href.includes('Post') || text.match(/\d{4}/)) {
        outputLines.push(`Link text: "${text}" | href: "${href}" | tag: ${el.name} | parent: ${el.parentNode ? el.parentNode.name : 'none'}`);
      }
    });

    // Let's also search for paragraphs or list items containing years
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/\b(2023|2024|2025|2026|2027)\b/) && text.length < 100 && el.name !== 'script' && el.name !== 'style') {
        outputLines.push(`Tag containing year: ${el.name}, text: "${text}", html: ${$(el).html().slice(0, 150)}`);
      }
    });

    fs.writeFileSync('archive_years.txt', outputLines.join('\n'));
    console.log('Done writing archive_years.txt');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
