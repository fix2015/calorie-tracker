import { photoSrc } from '../services/photoUrl';

export default function MealGrid({ meals, onMealClick, loading, sentinelRef }) {
  return (
    <>
      <div className="meal-grid">
        {meals.map((meal) => (
          <div key={meal.id} className="meal-tile" onClick={() => onMealClick(meal)}>
            {meal.photoUrl ? (
              <>
                <img src={photoSrc(meal.photoUrl)} alt={meal.name} loading="lazy" />
                <div className="meal-tile-overlay">
                  <span>{meal.name}</span>
                  <span style={{ float: 'right' }}>{meal.calories} kcal</span>
                </div>
              </>
            ) : (
              <div className="meal-tile-placeholder">
                <span className="meal-tile-name">{meal.name}</span>
                <span className="meal-tile-cals">{meal.calories} kcal</span>
                {meal._count && (
                  <span className="meal-tile-stats">
                    {meal._count.likes > 0 && `${meal._count.likes} likes`}
                    {meal._count.likes > 0 && meal._count.comments > 0 && ' \u00B7 '}
                    {meal._count.comments > 0 && `${meal._count.comments} comments`}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
          <div className="spinner"></div>
        </div>
      )}
      <div ref={sentinelRef} className="scroll-sentinel" />
    </>
  );
}
