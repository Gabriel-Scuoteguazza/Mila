const header = document.querySelector(".header")

if (header) {
    const updateHeader = () =>
        header.classList.toggle("is-scrolled", window.scrollY > 12)
    window.addEventListener("scroll", updateHeader, { passive: true })
    updateHeader()
}

document.querySelectorAll(".carousel").forEach((carousel) => {
    let isDragging = false
    let startX = 0
    let startScroll = 0

    carousel.addEventListener("pointerdown", (event) => {
        isDragging = true
        startX = event.clientX
        startScroll = carousel.scrollLeft
        carousel.setPointerCapture(event.pointerId)
        carousel.classList.add("is-dragging")
    })
    carousel.addEventListener("pointermove", (event) => {
        if (isDragging)
            carousel.scrollLeft = startScroll - (event.clientX - startX)
    })
    const stopDragging = () => {
        isDragging = false
        carousel.classList.remove("is-dragging")
    }
    carousel.addEventListener("pointerup", stopDragging)
    carousel.addEventListener("pointercancel", stopDragging)
})

const themeToggle = document.getElementById("theme-toggle")

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-mode")

        localStorage.setItem(
            "theme",
            document.body.classList.contains("light-mode") ? "light" : "dark",
        )
    })
}

if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode")
}


document.addEventListener("DOMContentLoaded", () => {
    const botaoDiferenciais = document.querySelector(".desenvolvimento2 .btn");

    if (botaoDiferenciais) {
        botaoDiferenciais.addEventListener("click", () => {
            window.scrollBy({
                top: 450, 
                behavior: 'smooth'
            });
        });
    }
});