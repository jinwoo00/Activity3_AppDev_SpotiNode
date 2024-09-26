document.getElementById('play-button').addEventListener('click', function() {
    const musicLink = document.getElementById('music-link').value;
    const audioPlayer = document.getElementById('audio-player');
    const audioSource = document.getElementById('audio-source');

    if (musicLink) {
        audioSource.src = musicLink; // Set the audio source to the provided link
        audioPlayer.load(); // Load the new audio source
        audioPlayer.play(); // Play the audio
    } else {
        alert('Please enter a valid music link');
    }
});
function playSong(id) {
    fetch(`/api/songs/play/${id}`)
        .then(response => {
            if (response.ok) {
                return response.blob();
            } else {
                throw new Error('Network response was not ok.');
            }
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const audioSource = document.getElementById('audio-source');
            audioSource.src = url;
            const audioPlayer = document.getElementById('audio-player');
            audioPlayer.load();
            audioPlayer.play();
        })
        .catch(error => console.error('Error playing song:', error));
}
