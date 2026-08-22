import { useState } from 'react';
import { Star } from 'lucide-react';

const StarRatingInput = ({
  value = 0,
  onChange,
  disabled = false,
  readOnly = false,
  maxStars = 5,
  size = 24,
  className = '',
}) => {
  const [hoverValue, setHoverValue] = useState(null);

  const activeValue = hoverValue !== null ? hoverValue : value;

  const handleClick = (star) => {
    if (disabled || readOnly) return;
    if (onChange) {
      onChange(star);
    }
  };

  return (
    <div
      className={`aria-star-rating flex items-center gap-1 ${className}`}
      data-testid="star-rating-input"
    >
      {Array.from({ length: maxStars }, (_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= activeValue;

        return (
          <button
            key={starValue}
            type="button"
            disabled={disabled || readOnly}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => !disabled && !readOnly && setHoverValue(starValue)}
            onMouseLeave={() => !disabled && !readOnly && setHoverValue(null)}
            className={`p-1 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-amber-400 ${
              disabled || readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            }`}
            aria-label={`${starValue} out of ${maxStars} stars`}
            data-testid={`star-button-${starValue}`}
          >
            <Star
              size={size}
              className={`transition-colors ${
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300 dark:text-gray-600 fill-transparent'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

export default StarRatingInput;
