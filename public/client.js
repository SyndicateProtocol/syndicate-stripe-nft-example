document.addEventListener('DOMContentLoaded', () => {
  const queryParams = new URLSearchParams(window.location.search);
  const sessionId = queryParams.get('session_id');
  let intervalId;
  let formSubmitted = false;


  if (sessionId) {
    document.getElementById('session-id').value = sessionId;
  } else {
    console.error('Session ID is missing');
  }

  const form = document.querySelector('.cancel-form');
  form.addEventListener('submit', handleFormSubmit);

  const updateMetadata = async () => {
    try {
      const response = await fetch(`/nft-metadata?session_id=${sessionId}`);
      if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
      }
      const metadata = await response.json();
      console.log('Metadata:', metadata);
      document.getElementById('image_url').setAttribute('src', metadata.image || '');
      document.getElementById('start_date').textContent = new Date(metadata.joined_date).toLocaleDateString('en-US') || 'Not available';
      document.getElementById('tier').textContent = metadata.tier || 'Not available';
      document.getElementById('status').textContent = metadata.status || 'Not available';
      document.getElementById('level').textContent = metadata.level || 0;
      document.getElementById('stamina').textContent = metadata.stamina || 0;
      document.getElementById('creator').textContent = metadata.creator || 0;
      document.getElementById('collaborator').textContent = metadata.collaborator || 0;
      document.getElementById('advisor').textContent = metadata.advisor || 0;
      document.getElementById('builder').textContent = metadata.builder || 0;
      document.getElementById('evangelist').textContent = metadata.evangelist || 0;

      if (metadata.stamina === 1 || (formSubmitted && metadata.status === "cancelled")) {
        clearInterval(intervalId);
      }
    } catch (error) {
        console.error('Error fetching metadata:', error.message);
    }
  };

  intervalId = setInterval(updateMetadata, 5000);

  async function handleFormSubmit(event) {
    event.preventDefault();
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new URLSearchParams(new FormData(form)),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log('Form submitted successfully');
      formSubmitted = true;
      
      intervalId = setInterval(updateMetadata, 5000);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  }
});