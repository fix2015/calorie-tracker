import { useState, useEffect, useRef, useCallback } from 'react';
import { storiesApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { photoSrc } from '../services/photoUrl';
import { useTranslation } from '../i18n';

function StoryViewer({ userStories, startIndex, onClose }) {
  const [currentUser, setCurrentUser] = useState(startIndex);
  const [currentStory, setCurrentStory] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  const userGroup = userStories[currentUser];
  const story = userGroup?.stories?.[currentStory];

  useEffect(() => {
    if (!story) return;
    storiesApi.view(story.id).catch(() => {});
  }, [story?.id]);

  useEffect(() => {
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [currentUser, currentStory]);

  const goNext = useCallback(() => {
    if (currentStory < (userGroup?.stories?.length || 0) - 1) {
      setCurrentStory(currentStory + 1);
    } else if (currentUser < userStories.length - 1) {
      setCurrentUser(currentUser + 1);
      setCurrentStory(0);
    } else {
      onClose();
    }
  }, [currentStory, currentUser, userGroup, userStories, onClose]);

  const goPrev = useCallback(() => {
    if (currentStory > 0) {
      setCurrentStory(currentStory - 1);
    } else if (currentUser > 0) {
      setCurrentUser(currentUser - 1);
      setCurrentStory(0);
    }
  }, [currentStory, currentUser]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const p = videoRef.current.currentTime / (videoRef.current.duration || 1);
    setProgress(p);
  };

  if (!story) return null;

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-viewer" onClick={(e) => e.stopPropagation()}>
        {/* Progress bars */}
        <div className="story-progress-row">
          {userGroup.stories.map((s, i) => (
            <div key={s.id} className="story-progress-bar">
              <div className="story-progress-fill" style={{ width: `${i < currentStory ? 100 : i === currentStory ? progress * 100 : 0}%` }} />
            </div>
          ))}
        </div>

        {/* User header */}
        <div className="story-header">
          {userGroup.user?.avatarUrl ? (
            <img src={photoSrc(userGroup.user.avatarUrl)} alt="" className="story-header-avatar" />
          ) : (
            <div className="story-header-avatar-placeholder">{userGroup.user?.name?.charAt(0)?.toUpperCase() || '?'}</div>
          )}
          <span className="story-header-name">{userGroup.user?.username || userGroup.user?.name}</span>
          <button className="story-close" onClick={onClose}>&times;</button>
        </div>

        {/* Video */}
        <video
          ref={videoRef}
          src={story.videoUrl}
          className="story-video"
          autoPlay
          playsInline
          muted={false}
          onTimeUpdate={handleTimeUpdate}
          onEnded={goNext}
        />

        {/* Tap zones */}
        <div className="story-tap-left" onClick={goPrev} />
        <div className="story-tap-right" onClick={goNext} />
      </div>
    </div>
  );
}

export default function StoryRing() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [storyUsers, setStoryUsers] = useState([]);
  const [viewerOpen, setViewerOpen] = useState(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    storiesApi.feed().then((data) => setStoryUsers(data.users || [])).catch(() => {});
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await storiesApi.upload(file);
      const data = await storiesApi.feed();
      setStoryUsers(data.users || []);
    } catch (err) {
      alert(err.error || t('stories.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const myStories = storyUsers.find(u => u.userId === user?.id);
  const hasMyStory = !!myStories;

  return (
    <>
      <div className="stories-row">
        {/* Add story / My story */}
        <div className="story-item" onClick={() => hasMyStory ? setViewerOpen(0) : fileRef.current?.click()}>
          <div className={`story-avatar-ring${hasMyStory ? (myStories.hasUnviewed ? ' unviewed' : ' viewed') : ' add'}`}>
            {user?.avatarUrl ? (
              <img src={photoSrc(user.avatarUrl)} alt="" className="story-avatar" />
            ) : (
              <div className="story-avatar-placeholder">{user?.name?.charAt(0)?.toUpperCase() || '?'}</div>
            )}
            {!hasMyStory && <div className="story-add-badge">+</div>}
          </div>
          <span className="story-name">{hasMyStory ? t('stories.yourStory') : t('stories.addStory')}</span>
          {uploading && <div className="spinner" style={{ width: 16, height: 16 }} />}
        </div>

        {/* Other users' stories */}
        {storyUsers.filter(u => u.userId !== user?.id).map((su, i) => (
          <div key={su.userId} className="story-item" onClick={() => setViewerOpen(hasMyStory ? i + 1 : i)}>
            <div className={`story-avatar-ring${su.hasUnviewed ? ' unviewed' : ' viewed'}`}>
              {su.user?.avatarUrl ? (
                <img src={photoSrc(su.user.avatarUrl)} alt="" className="story-avatar" />
              ) : (
                <div className="story-avatar-placeholder">{su.user?.name?.charAt(0)?.toUpperCase() || '?'}</div>
              )}
            </div>
            <span className="story-name">{su.user?.username || su.user?.name}</span>
          </div>
        ))}

        <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleUpload} style={{ display: 'none' }} />
      </div>

      {viewerOpen !== null && (
        <StoryViewer
          userStories={storyUsers}
          startIndex={viewerOpen}
          onClose={() => {
            setViewerOpen(null);
            storiesApi.feed().then((data) => setStoryUsers(data.users || [])).catch(() => {});
          }}
        />
      )}
    </>
  );
}
