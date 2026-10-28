/** Round avatar: the person's photo when they have one, otherwise their initials on Signal Green. */
export default function Avatar({ user, size = 32 }) {
  const name = user?.name || '?';
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      title={name}
    >
      {user?.avatar
        ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : name.slice(0, 2).toUpperCase()}
    </div>
  );
}
