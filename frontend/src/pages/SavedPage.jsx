import { useState, useEffect, useCallback } from 'react';
import { publicApi } from '../services/api';
import { photoSrc } from '../services/photoUrl';
import { useInfiniteScroll } from '../services/useInfiniteScroll';
import PublicMealDetailModal from '../components/PublicMealDetailModal';

export default function SavedPage() {
  const [meals, setMeals] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);

  useEffect(() => {
    publicApi.savedMeals().then((data) => {
      setMeals(data.meals);
      setNextCursor(data.nextCursor);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    publicApi.savedMeals(nextCursor).then((data) => {
      setMeals((prev) => [...prev, ...data.meals]);
      setNextCursor(data.nextCursor);
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [nextCursor, loadingMore]);

  const sentinelRef = useInfiniteScroll(fetchMore, !!nextCursor && !loadingMore);

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      {meals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0', color: 'var(--color-text-secondary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3, marginBottom: 'var(--space-md)' }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>No saved meals yet</p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>Tap the bookmark icon on any meal to save it here</p>
        </div>
      ) : (
        <>
          <div className="discover-grid">
            {meals.map((meal) => (
              <div key={meal.id} className="discover-card" onClick={() => setSelectedMeal(meal)}>
                {meal.photoUrl ? (
                  <div className="discover-card-img-wrap">
                    <img src={photoSrc(meal.photoUrl)} alt={meal.name} loading="lazy" />
                    <div className="discover-card-overlay">
                      <span className="discover-card-name">{meal.name}</span>
                      <span className="discover-card-kcal">{meal.calories} kcal</span>
                    </div>
                  </div>
                ) : (
                  <div className="discover-card-placeholder">
                    <span className="discover-card-name">{meal.name}</span>
                    <span className="discover-card-kcal">{meal.calories} kcal</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {loadingMore && <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}><div className="spinner"></div></div>}
          <div ref={sentinelRef} className="scroll-sentinel" />
        </>
      )}

      {selectedMeal && (
        <PublicMealDetailModal
          mealId={selectedMeal.id}
          username={selectedMeal.user?.username}
          onClose={() => setSelectedMeal(null)}
        />
      )}
    </div>
  );
}
