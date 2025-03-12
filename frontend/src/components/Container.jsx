const Container = ({ children, className = "" }) => {
  return (
    <div className={`h-full w-full mx-auto max-w-4xl ${className}`}>
      {children}
    </div>
  );
};

export default Container;
