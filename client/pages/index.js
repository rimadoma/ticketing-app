const LandingPage = ({ currentUser }) => {
    if (currentUser) {
        return <h1>You're signed in</h1>;
    }

   return <h1>You're NOT signed in</h1>;
};

export default LandingPage;