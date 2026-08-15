const cards = document.querySelectorAll('.ref-card')
const modals = document.querySelectorAll('.modal')
const closeButtons = document.querySelectorAll('.close-button')

cards.forEach(card => {
    card.addEventListener('click', () => {
        const modal = document.getElementById(card.getAttribute('data-modal'))
        modal.classList.remove('hide')
        modal.classList.add('show')
    })
})

function closeModal(modal) {
    modal.classList.remove('show')
    modal.classList.add('hide')
    setTimeout(() => {
        modal.classList.remove('hide')
    }, 300)
}

closeButtons.forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal')))
})

window.addEventListener('click', (e) => {
    modals.forEach(modal => {
        if (e.target === modal) closeModal(modal)
    })
})