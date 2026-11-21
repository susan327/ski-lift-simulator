import { courses, places, resortName, terrainHeight } from './resort.js';

const dialog = document.querySelector('#trail-map');
const canvas = document.querySelector('#map-view');
const ctx = canvas.getContext('2d');
const list = document.querySelector('.trail-list');
const image = ctx.createImageData(canvas.width, canvas.height);
const xScale = 2.45;
const alongScale = 0.74;
const left = 97;
const bottom = 313;
const project = (x, along) => [left + x * xScale, bottom - along * alongScale];
let selected = null;

document.querySelector('h1').textContent = resortName;
document.querySelector('#show-map').addEventListener('click', () => dialog.showModal());

for (let y = 0; y < canvas.height; y++) {
  for (let x = 0; x < canvas.width; x++) {
    const worldX = (x - left) / xScale;
    const along = (bottom - y) / alongScale;
    const h = terrainHeight(worldX, along);
    const shade = (terrainHeight(worldX - 1, along + 1) - h) * 16;
    const contour = h >= 4 && h % 6 < 0.30 ? 13 : 0;
    const offset = (y * canvas.width + x) * 4;
    image.data.set([224 + shade - contour, 240 + shade - contour,
      246 + shade - contour, 255], offset);
  }
}

function line(points, color, width, dash = []) {
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  points.forEach(([x, y], i) => {
    const [screenX, screenY] = project(x, y);
    if (i === 0) ctx.moveTo(screenX, screenY);
    else ctx.lineTo(screenX, screenY);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function mark(place, dx, dy, planned = false) {
  const [x, y] = project(place.x, place.along);
  ctx.strokeStyle = '#264a55';
  ctx.lineWidth = 3;
  ctx.fillStyle = planned ? '#c3d6e2' : '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.font = 'bold 17px system-ui';
  ctx.strokeStyle = '#f1f9fb';
  ctx.lineWidth = 4;
  ctx.strokeText(place.name, x + dx, y + dy);
  ctx.fillStyle = '#193540';
  ctx.fillText(place.name, x + dx, y + dy);
}

function drawMap() {
  ctx.putImageData(image, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  line([[places.pairBase.x, places.pairBase.along], [places.pairTop.x, places.pairTop.along]], '#294c56', 5);
  line([[places.quadBase.x, places.quadBase.along], [places.quadTop.x, places.quadTop.along]], '#455e85', 5);
  courses.forEach((course, index) => {
    line(course.samples, '#f8fcff', selected === index ? 14 : 10);
    line(course.samples, course.color, selected === index ? 10 : 6, course.level === '連絡' ? [8, 6] : []);
  });
  mark(places.pairTop, -77, -14);
  mark(places.pairBase, -77, 6);
  mark(places.quadTop, 13, -14);
  mark(places.quadBase, 14, 6);
  mark(places.base, 14, 4);
  ctx.fillStyle = '#294c56';
  ctx.font = 'bold 16px system-ui';
  ctx.fillText('山頂側', 18, 27);
  ctx.fillText('麓側', 18, canvas.height - 16);
}

courses.forEach((course, index) => {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'course-choice';
  button.style.setProperty('--course-color', course.color);
  button.setAttribute('aria-pressed', 'false');
  const title = document.createElement('strong');
  title.textContent = course.name + ' · ' + course.level;
  const text = document.createElement('span');
  text.textContent = course.description;
  button.append(title, text);
  button.addEventListener('click', () => {
    selected = selected === index ? null : index;
    for (const [i, option] of [...list.querySelectorAll('button')].entries()) {
      option.setAttribute('aria-pressed', String(i === selected));
    }
    drawMap();
  });
  item.append(button);
  list.append(item);
});

drawMap();
