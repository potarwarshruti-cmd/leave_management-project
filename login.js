document.addEventListener('DOMContentLoaded', () => {
    // --- FINAL VERSION ---
    // This file handles the login.html page only.

    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginError.style.display = 'none'; // Hide error on new submit

        // --- KEY FIX ---
        // trim() removes whitespace, toLowerCase() fixes case-sensitivity
        const email = emailInput.value.trim().toLowerCase();
        
        const password = passwordInput.value; // We don't validate password in this demo

        // --- Email Validation ---
        if (!email.endsWith('@adypu.edu.in')) {
            loginError.textContent = 'Access Denied. Please use a valid @adypu.edu.in email.';
            loginError.style.display = 'block';
            return;
        }

        // --- Role Simulation ---
        let user;
        // This check will now work even if you type " Admin@adypu.edu.in "
        if (email === 'admin@adypu.edu.in') {
            user = {
                email: email,
                role: 'admin'
            };
        } else {
            user = {
                email: email,
                role: 'student'
            };
        }

        // --- Save to Session (localStorage) and Redirect ---
        localStorage.setItem('currentUser', JSON.stringify(user));

        // Redirect to the main app page
        window.location.href = 'index.html';
    });
});