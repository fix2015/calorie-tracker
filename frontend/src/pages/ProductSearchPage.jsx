import { useState, useRef, useCallback } from 'react';
import { productsApi } from '../services/api';
import { useTranslation } from '../i18n';

const NUTRISCORE_COLORS = {
  a: '#038141', b: '#85BB2F', c: '#FECB02', d: '#EE8100', e: '#E63E11',
};

function MacroBar({ label, value, unit, color, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, minWidth: 70 }}>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{value}<span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400 }}>{unit}</span></div>
      <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, marginTop: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export default function ProductSearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [viewMode, setViewMode] = useState({});
  const debounceRef = useRef(null);

  const doSearch = useCallback((q, p = 1) => {
    if (!q.trim() || q.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    productsApi.search(q.trim(), p).then((data) => {
      if (p === 1) {
        setProducts(data.products);
      } else {
        setProducts(prev => [...prev, ...data.products]);
      }
      setTotal(data.total);
      setPage(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (v.trim().length >= 2) {
        setProducts([]);
        doSearch(v, 1);
      }
    }, 400);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    setProducts([]);
    doSearch(query, 1);
  };

  const loadMore = () => doSearch(query, page + 1);

  const toggleView = (code) => {
    setViewMode(prev => ({ ...prev, [code]: prev[code] === 'serving' ? '100g' : 'serving' }));
  };

  return (
    <div className="page" style={{ padding: 'var(--space-md)' }}>
      <form onSubmit={handleSubmit} style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--color-bg)', paddingBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              value={query}
              onChange={handleInput}
              placeholder={t('productSearch.placeholder')}
              style={{
                width: '100%', padding: 'var(--space-sm) var(--space-md) var(--space-sm) 40px',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-input)', minHeight: 44, outline: 'none',
                background: 'var(--color-surface)', color: 'var(--color-text)',
              }}
            />
          </div>
        </div>
      </form>

      {!searched && !loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0', color: 'var(--color-text-secondary)' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, marginBottom: 'var(--space-md)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{t('productSearch.title')}</p>
          <p style={{ fontSize: 'var(--font-size-sm)', maxWidth: 300, margin: '0 auto' }}>{t('productSearch.subtitle')}</p>
        </div>
      )}

      {searched && products.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{t('productSearch.noResults')}</p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>{t('productSearch.tryDifferent')}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {products.map((p) => {
          const isExpanded = expanded === p.code;
          const mode = viewMode[p.code] || (p.perServing ? 'serving' : '100g');
          const n = mode === 'serving' && p.perServing ? p.perServing : p.per100g;
          const label = mode === 'serving' ? (p.servingSize || t('productSearch.perServing')) : t('productSearch.per100g');

          return (
            <div
              key={p.code}
              className="card"
              style={{ padding: 'var(--space-md)', cursor: 'pointer', transition: 'box-shadow 0.2s' }}
              onClick={() => setExpanded(isExpanded ? null : p.code)}
            >
              <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl} alt={p.name} loading="lazy"
                    style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', background: 'var(--color-border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" opacity="0.4"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  {p.brand && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>{n.calories}</div>
                  <div style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-secondary)' }}>{t('common.kcal')}</div>
                </div>
                {p.nutriscoreGrade && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 'var(--radius-xs)', fontWeight: 800, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0,
                    background: NUTRISCORE_COLORS[p.nutriscoreGrade] || 'var(--color-text-secondary)',
                  }}>
                    {p.nutriscoreGrade.toUpperCase()}
                  </div>
                )}
              </div>

              {isExpanded && (
                <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }} onClick={e => e.stopPropagation()}>
                  {p.perServing && (
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                      <button
                        className={`btn ${mode === '100g' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, minHeight: 36, fontSize: 'var(--font-size-sm)' }}
                        onClick={() => toggleView(p.code)}
                      >
                        {t('productSearch.per100g')}
                      </button>
                      <button
                        className={`btn ${mode === 'serving' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, minHeight: 36, fontSize: 'var(--font-size-sm)' }}
                        onClick={() => toggleView(p.code)}
                      >
                        {p.servingSize || t('productSearch.perServing')}
                      </button>
                    </div>
                  )}

                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                    {label}
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                    <MacroBar label={t('common.calories')} value={n.calories} unit={t('common.kcal')} color="var(--color-primary)" max={800} />
                    <MacroBar label={t('common.protein')} value={n.protein} unit="g" color="#3B82F6" max={50} />
                    <MacroBar label={t('common.carbs')} value={n.carbs} unit="g" color="#F59E0B" max={100} />
                    <MacroBar label={t('common.fat')} value={n.fat} unit="g" color="#EF4444" max={65} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                    <div style={{ padding: 'var(--space-sm)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('productSearch.fiber')}</span>
                      <span style={{ float: 'right', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{n.fiber}g</span>
                    </div>
                    <div style={{ padding: 'var(--space-sm)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('productSearch.sugar')}</span>
                      <span style={{ float: 'right', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{n.sugar}g</span>
                    </div>
                    <div style={{ padding: 'var(--space-sm)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('productSearch.saturatedFat')}</span>
                      <span style={{ float: 'right', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{n.saturatedFat}g</span>
                    </div>
                    <div style={{ padding: 'var(--space-sm)', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{t('productSearch.sodium')}</span>
                      <span style={{ float: 'right', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{n.sodium}g</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}><div className="spinner" /></div>}

      {!loading && products.length > 0 && products.length < total && (
        <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
          <button className="btn btn-secondary" onClick={loadMore}>{t('productSearch.loadMore')}</button>
        </div>
      )}

      {searched && products.length > 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {t('productSearch.poweredBy')}
        </div>
      )}
    </div>
  );
}
