const test = require('node:test');
const assert = require('node:assert/strict');
const { getKstDate, parseGeekNewsItems } = require('./index');

test('getKstDate uses the calendar date in Korea', () => {
  assert.equal(getKstDate(new Date('2026-06-21T22:07:00Z')), '2026-06-22');
});

test('parseGeekNewsItems supports the current h2 title markup', () => {
  const html = `
    <div class="topic_row">
      <div class="topictitle">
        <a href="https://example.com/article"><h2 class="topic-title-heading">Test article</h2></a>
      </div>
      <div class="topicdesc"><a href="topic?id=30701">Article summary</a></div>
      <div class="topicinfo"><span id="tp30701">39</span> points</div>
    </div>`;

  assert.deepEqual(parseGeekNewsItems(html), [{
    title: 'Test article',
    link: 'https://example.com/article',
    score: 39,
    content: 'Article summary',
    geeknewsLink: 'https://news.hada.io/topic?id=30701'
  }]);
});

test('parseGeekNewsItems remains compatible with the previous h1 markup', () => {
  const html = `
    <div class="topic_row">
      <div class="topictitle"><a href="https://example.com/old"><h1>Old article</h1></a></div>
      <div class="topicdesc"><a href="topic?id=1">Old summary</a></div>
      <div class="topicinfo"><span id="tp1">7</span></div>
    </div>`;

  assert.equal(parseGeekNewsItems(html)[0].title, 'Old article');
});
