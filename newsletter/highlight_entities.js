// Script to add entity highlighting to newsletter HTML
const fs = require('fs');

const html = fs.readFileSync('NEWSLETTER.html', 'utf8');

// Define patterns for highlighting
const patterns = [
  // Numbers - bold white
  { regex: /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|hours?|votes?|days?|employees?|percent|%|arrests?|fighters?|prisoners?|drones?|missiles?|boats?|activists?)\b/gi,
    replace: (match, num, unit) => `<span class="number">${num} ${unit}</span>` },
  { regex: /\b(\d+)-(\w+)\b/g, replace: '<span class="number">$1-$2</span>' }, // 21-point, 7-10 day
  { regex: /\b(sixty|seventy|fifty|forty|over \d+)\b/gi, replace: '<span class="number">$1</span>' },

  // People - yellow
  { regex: /\b(President |Prime Minister |Senator |Gen\. |Secretary |Chairman |Chief )(Trump|Netanyahu|Blair|Schumer|Sanders|Fetterman|Paul|King|Shaheen|Hegseth|Caine|Mills|Shoukry|Grossi|Syrskyi)\b/g,
    replace: '<span class="person">$1$2</span>' },

  // Organizations - teal
  { regex: /\b(NATO|Hamas|UN|Red Crescent|IDF|IAEA|Congressional Budget Office|Library of Congress|Department of Justice|ICE|Palestinian Islamic Jihad|Iron Dome|Doctors Without Borders|MSF|Global Sumud Flotilla)\b/g,
    replace: '<span class="organization">$1</span>' },

  // Locations - green
  { regex: /\b(Russia|Ukraine|Israel|Gaza|Qatar|Poland|Kyiv|Doha|Spain|UK|Jordan|UAE|Indonesia|Pakistan|Turkey|Saudi Arabia|Egypt|Broadview|Illinois|Portland|Oregon|Quantico|Ashdod|Zaporizhzhia|Poltava|Sumy|Chernihiv|Kharkiv|Haiti|Somalia)\b/g,
    replace: '<span class="location">$1</span>' }
];

let result = html;

// Apply all patterns
patterns.forEach(pattern => {
  result = result.replace(pattern.regex, pattern.replace);
});

fs.writeFileSync('NEWSLETTER.html', result);
console.log('Entity highlighting applied!');
