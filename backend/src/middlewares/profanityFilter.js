const badWords = require('bad-words');

const FilterClass = badWords.Filter || badWords;
const filter = new FilterClass();

const profanityFilter = (req, _res, next) => {
  const textToCheck = [req.body.text, req.body.comment, req.body.title].filter(Boolean).join(' ');

  if (textToCheck && filter.isProfane(textToCheck)) {
    req.isProfane = true;
    req.body.status = 'flagged';
  }

  next();
};

module.exports = profanityFilter;
