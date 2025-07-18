// JavaScript for ShadowHawk Password Manager Promotional Page

document.addEventListener('DOMContentLoaded', function() {
    // Theme Toggle Functionality
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    
    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('promotional-theme') || 'dark';
    setTheme(savedTheme);
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = html.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('promotional-theme', newTheme);
    });
    
    function setTheme(theme) {
        html.setAttribute('data-bs-theme', theme);
        const icon = themeToggle.querySelector('i');
        
        if (theme === 'dark') {
            icon.className = 'bi bi-sun-fill';
        } else {
            icon.className = 'bi bi-moon-stars-fill';
        }
        
        // Update screenshots based on theme
        updateScreenshots(theme);
        
        // Update navbar background immediately based on theme
        const navbar = document.querySelector('.navbar');
        const scrollY = window.scrollY;
        
        if (scrollY > 100) {
            if (theme === 'light') {
                navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            } else {
                navbar.style.background = 'rgba(26, 26, 26, 0.98)';
            }
        } else {
            if (theme === 'light') {
                navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            } else {
                navbar.style.background = 'rgba(26, 26, 26, 0.95)';
            }
        }
    }
    
    // Update screenshots based on current theme
    function updateScreenshots(theme) {
        const themeScreenshots = document.querySelectorAll('.theme-screenshot');
        
        themeScreenshots.forEach(img => {
            const darkSrc = img.getAttribute('data-dark');
            const lightSrc = img.getAttribute('data-light');
            
            if (darkSrc && lightSrc) {
                if (theme === 'dark') {
                    img.src = darkSrc;
                } else {
                    img.src = lightSrc;
                }
            }
        });
    }
    
    // Smooth Scrolling for Navigation Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.offsetTop - 80; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Navbar Background on Scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function() {
        const currentTheme = html.getAttribute('data-bs-theme');
        
        if (window.scrollY > 100) {
            if (currentTheme === 'light') {
                navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            } else {
                navbar.style.background = 'rgba(26, 26, 26, 0.98)';
            }
        } else {
            if (currentTheme === 'light') {
                navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            } else {
                navbar.style.background = 'rgba(26, 26, 26, 0.95)';
            }
        }
    });
    
    // Animate Elements on Scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, observerOptions);
    
    // Add animation class to elements
    document.querySelectorAll('.feature-card, .screenshot-card').forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
    
    // Typing Effect for Hero Title - Skip for better UX
    // The typing effect can interfere with HTML rendering, so we'll keep the original text
    // const heroTitle = document.querySelector('.hero-content h1');
    // if (heroTitle) {
    //     const originalText = heroTitle.innerHTML;
    //     heroTitle.innerHTML = '';
    //     
    //     setTimeout(() => {
    //         typeWriter(heroTitle, originalText, 0);
    //     }, 500);
    // }
    
    // function typeWriter(element, text, index) {
    //     if (index < text.length) {
    //         element.innerHTML += text.charAt(index);
    //         setTimeout(() => typeWriter(element, text, index + 1), 50);
    //     }
    // }
    
    // Particle Effect for Hero Section
    createParticles();
    
    function createParticles() {
        const heroSection = document.querySelector('.hero-section');
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: 2px;
                height: 2px;
                background: rgba(66, 133, 244, 0.6);
                border-radius: 50%;
                pointer-events: none;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: float ${3 + Math.random() * 4}s ease-in-out infinite;
                animation-delay: ${Math.random() * 2}s;
            `;
            heroSection.appendChild(particle);
        }
    }
    
    // Download Button Animations
    document.querySelectorAll('.download-card button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Change button text temporarily
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bi bi-check-circle me-2"></i>Coming Soon!';
            this.classList.add('btn-success');
            this.classList.remove('btn-light');
            
            setTimeout(() => {
                this.innerHTML = originalText;
                this.classList.remove('btn-success');
                this.classList.add('btn-light');
            }, 2000);
        });
    });
    
    // Feature Card Hover Effects
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Mock App Window Interactions
    const mockPasswordItems = document.querySelectorAll('.mock-password-item');
    mockPasswordItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            mockPasswordItems.forEach(i => i.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
            
            // Add some visual feedback
            this.style.background = 'rgba(66, 133, 244, 0.2)';
            setTimeout(() => {
                this.style.background = '';
            }, 300);
        });
    });
    
    // Add CSS for active mock item
    const style = document.createElement('style');
    style.textContent = `
        .mock-password-item.active {
            background: rgba(66, 133, 244, 0.1) !important;
            border-left: 3px solid var(--primary-color);
        }
    `;
    document.head.appendChild(style);
    
    // Stats Counter Animation
    function animateCounters() {
        const stats = document.querySelectorAll('.hero-stats h3');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    const text = target.textContent;
                    
                    if (text === '256-bit') {
                        animateNumber(target, 0, 256, 'bit', 2000);
                    } else if (text === '100%') {
                        animateNumber(target, 0, 100, '%', 1500);
                    } else if (text === '0') {
                        animateNumber(target, 10, 0, '', 1000);
                    }
                    
                    observer.unobserve(target);
                }
            });
        });
        
        stats.forEach(stat => observer.observe(stat));
    }
    
    function animateNumber(element, start, end, suffix, duration) {
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = start + (end - start) * easeOutQuart(progress);
            element.textContent = Math.floor(current) + (suffix === 'bit' ? '-bit' : suffix);
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        requestAnimationFrame(update);
    }
    
    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }
    
    animateCounters();
    
    // Add loading animation to download buttons
    function addLoadingAnimation(button) {
        button.addEventListener('click', function(e) {
            if (this.classList.contains('loading')) return;
            
            e.preventDefault();
            this.classList.add('loading');
            
            const originalContent = this.innerHTML;
            let dots = '';
            
            const loadingInterval = setInterval(() => {
                dots += '.';
                if (dots.length > 3) dots = '';
                this.innerHTML = `<i class="bi bi-arrow-clockwise me-2 spin"></i>Preparing${dots}`;
            }, 300);
            
            setTimeout(() => {
                clearInterval(loadingInterval);
                this.innerHTML = '<i class="bi bi-check-circle me-2"></i>Ready!';
                this.classList.remove('loading');
                
                setTimeout(() => {
                    this.innerHTML = originalContent;
                }, 1500);
            }, 2000);
        });
    }
    
    // Add loading animation to all download buttons
    document.querySelectorAll('#download .btn').forEach(addLoadingAnimation);
    
    // Add spin animation for loading
    const spinStyle = document.createElement('style');
    spinStyle.textContent = `
        .spin {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .loading {
            pointer-events: none;
            opacity: 0.8;
        }
    `;
    document.head.appendChild(spinStyle);
    
    // Parallax effect for hero section - MINIMAL movement for stability
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroSection = document.querySelector('.hero-section');
        const heroHeight = heroSection.offsetHeight;
        
        // Calculate parallax speed but limit it to very minimal movement
        const maxScroll = heroHeight / 4; // Stop sliding at quarter point
        const limitedScroll = Math.min(scrolled, maxScroll);
        const speed = limitedScroll * 0.1; // Much reduced speed for minimal movement
        
        // Apply very subtle parallax to hero background
        heroSection.style.transform = `translateY(${speed}px)`;
    });
    
    // Add smooth reveal animation for sections
    const sections = document.querySelectorAll('section');
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });
    
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        sectionObserver.observe(section);
    });
    
    // Hero section should be visible immediately
    document.querySelector('.hero-section').style.opacity = '1';
    document.querySelector('.hero-section').style.transform = 'translateY(0)';
    
    // Screenshot Modal Functionality
    const screenshotModal = new bootstrap.Modal(document.getElementById('screenshotModal'));
    const modalScreenshot = document.getElementById('modalScreenshot');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    
    // Add click event listeners to all screenshot containers
    const screenshotContainers = document.querySelectorAll('.main-screenshot, .secondary-screenshot, .theme-screenshot, .feature-screenshot');
    
    screenshotContainers.forEach(container => {
        container.addEventListener('click', function(e) {
            e.preventDefault();
            
            const img = container.querySelector('.screenshot-img');
            const overlay = container.querySelector('.screenshot-overlay');
            
            if (img) {
                // Set modal image source
                modalScreenshot.src = img.src;
                modalScreenshot.alt = img.alt;
                
                // Set modal title and description
                if (overlay) {
                    const titleElement = overlay.querySelector('h5, h6');
                    const descElement = overlay.querySelector('p');
                    
                    if (titleElement) {
                        modalTitle.textContent = titleElement.textContent;
                    } else {
                        modalTitle.textContent = img.alt;
                    }
                    
                    if (descElement) {
                        modalDescription.textContent = descElement.textContent;
                    } else {
                        modalDescription.textContent = '';
                    }
                } else {
                    modalTitle.textContent = img.alt;
                    modalDescription.textContent = '';
                }
                
                // Show modal
                screenshotModal.show();
            }
        });
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            screenshotModal.hide();
        }
    });
});

// Add some easter eggs
document.addEventListener('keydown', function(e) {
    // Konami Code: ↑↑↓↓←→←→BA
    const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    let userInput = [];
    
    userInput.push(e.keyCode);
    if (userInput.length > konamiCode.length) {
        userInput.shift();
    }
    
    if (JSON.stringify(userInput) === JSON.stringify(konamiCode)) {
        // Easter egg activated!
        document.body.style.animation = 'rainbow 2s ease-in-out';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes rainbow {
                0% { filter: hue-rotate(0deg); }
                100% { filter: hue-rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            document.body.style.animation = '';
            style.remove();
        }, 2000);
    }
});
