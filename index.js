const header = document.querySelector('.header');

if (header) {
    const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
}

document.querySelectorAll('.carousel').forEach((carousel) => {
    let isDragging = false;
    let startX = 0;
    let startScroll = 0;

    carousel.addEventListener('pointerdown', (event) => {
        isDragging = true;
        startX = event.clientX;
        startScroll = carousel.scrollLeft;
        carousel.setPointerCapture(event.pointerId);
        carousel.classList.add('is-dragging');
    });
    carousel.addEventListener('pointermove', (event) => {
        if (isDragging) carousel.scrollLeft = startScroll - (event.clientX - startX);
    });
    const stopDragging = () => {
        isDragging = false;
        carousel.classList.remove('is-dragging');
    };
    carousel.addEventListener('pointerup', stopDragging);
    carousel.addEventListener('pointercancel', stopDragging);
});
