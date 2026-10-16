const files = {
  poekhali: ['poekhali-utils.js', 'poekhali-map-parser.js', 'poekhali-warnings.js', 'poekhali-backup.js', 'poekhali-tracker.js'],
  docs: ['docs-app.js'],
  vu45: ['vu45-calculator.js', 'vu45-ui.js']
};
const loaded = new Map(), features = new Map();
function script(file) {
  if (loaded.has(file)) return loaded.get(file);
  const task = new Promise((resolve, reject) => {
    const element = document.createElement('script');
    element.src = new URL(file, import.meta.url).href;
    element.onload = resolve;
    element.onerror = () => { element.remove(); loaded.delete(file); reject(new Error('Не удалось загрузить раздел. Проверьте сеть и повторите.')); };
    document.head.append(element);
  });
  loaded.set(file, task);
  return task;
}
export function loadFeature(name) {
  if (!files[name]) return Promise.reject(new Error('Unknown feature'));
  if (features.has(name)) return features.get(name);
  const task = (async () => { for (const file of files[name]) await script(file); })()
    .catch(error => { features.delete(name); throw error; });
  features.set(name, task);
  return task;
}
