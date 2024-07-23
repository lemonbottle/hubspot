//      ______                _ __   __  ____                      _            
//     / ____/___ ___  ____ _(_) /  /  |/  (_)_____________  _____(_)___  ____ _
//    / __/ / __ `__ \/ __ `/ / /  / /|_/ / / ___/ ___/ __ \/ ___/ / __ \/ __ `/
//   / /___/ / / / / / /_/ / / /  / /  / / / /  / /  / /_/ / /  / / / / / /_/ / 
//  /_____/_/ /_/ /_/\__,_/_/_/  /_/  /_/_/_/  /_/   \____/_/  /_/_/ /_/\__, /  
//                                                                     /____/                                                                    
//              by Sasha Sosin at RevPartners (svsosin@revpartners.io)
//   
//
// 
// This script attempts to bypass HubSpot's tracking limitations. 
// 
// The problem:
//  HubSpot tracking script creates a cookie that follows you around.
//  Until you fill out a form with your Email, it doesn't know who you are.
//  Enabling "Non-HubSpot Form Tracking" doesn't always fix the issue.
//  Many forms are incorrectly coded or contain sensitive fields.
//  This breaks the tracking functionality.
//  You're left with no conversion data like original source or page views.
// 
// The solution:
//  Add a hidden hubspot form, inject the user's email and submit it to HubSpot.
//
// This script does several things: 
//  1. Inserts a HubSpot form on the page. 
//  2. Detects any other email field on the page (as long as it has type='email') in the HTML tag.
//  3. Mirrors the two fields together. Whatever you type into the email field will get sent to the HubSpot field.
//  4. When you click Submit on the normal form, this script will submit the HubSpot form too. 
// 
// How to use:
//  1. Install the HubSpot tracking script to your website.
//  2. Replace portalId and formId variables with your HubSpot portal and form you want to use.
//  3. Adjust the form selector variables to match your target form to be filled by the user.
//  4. Add your website to the list of allowed URLs below.
//  4b. Add your blocked URLs to the blocklist. Helpful for login pages.
//  5. Install this javascript file below the HubSpot tracking code. 
//  
//  You can get the direct link to this file by clicking "Show output" in the menu above and looking at the text below: {{ get_asset_url('./email-mirror.js') }}
//
// You might want to remove .min from the URL.
// 
// Troubleshooting:
//  Enable debugMode to 'true' in the code below.


(function() {

	console.log('mirror script initialized')

	'use strict';

	// 1. Set debugMode to true if you want to see the form and console logs
	let debugMode = false;

	// 2. Replace portalId and formId with your HubSpot portal and form you want to use.
	const portalId = "40106701";
	const formId = "560994f6-399a-484a-8232-7fe9f92fa150";

	// 3. Modify these selectors to match the elements on your target form
	const EMAIL_FIELD_SELECTOR = '#account_email';
	const FORM_SUBMIT_BUTTON_SELECTOR = 'form button[type="button"]';

	// 4. List of allowed URLs
	const allowedUrls = [
		"*://app.textinchurch.com/*",
		"*://anotherwebsite.com/*"
	];

	// 5. List of blocked URLs
	const blockedUrls = [
		"*://app.textinchurch.com/login*",
		"*://app.textinchurch.com/connect-cards*",
		"*://some-website.com/*"
	];

	const blockedUrlPatterns = blockedUrls.map(wildcardToRegExp);
	const isBlockedUrl = blockedUrlPatterns.some(pattern => pattern.test(window.location.href));

	if (isBlockedUrl) {
		console.error("⚠️ Current URL is blocked. Email Mirroring script will not run.");
		return; // Exit the script if the URL is blocked
	}


	function debug(...messages) {
		if (debugMode) {
			console.log(...messages);
		}
	}

	// Check if URL is in whitelist
	function wildcardToRegExp(url) {
		return new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*'));
	}
	const allowedUrlPatterns = allowedUrls.map(wildcardToRegExp);
	const isAllowedUrl = allowedUrlPatterns.some(pattern => pattern.test(window.location.href));

	if (isAllowedUrl) {
		debug("URL is allowed. Proceeding");

		// Embed HS form
		(function() {
			// Create a script element for the HubSpot forms library
			var script = document.createElement('script');
			script.setAttribute('charset', 'utf-8');
			script.setAttribute('type', 'text/javascript');
			script.setAttribute('src', '//js.hsforms.net/forms/embed/v2.js');

			// Append the script element to the head of the document
			document.head.appendChild(script);

			// Ensure the HubSpot forms library has loaded before executing the forms.create function
			script.onload = function() {
				hbspt.forms.create({
					region: "na1",
					portalId: portalId,
					formId: formId,
					onFormReady: function($form) {
						debug("HubSpot form is ready");
					}
				});
			};
		})();

		(function() {

			debug("Debug is on");

			// Conditionally hide the HubSpot form based on debug mode
			if (!debugMode) {
				var style = document.createElement('style');
				style.innerHTML = `
                .hs-form {
                    visibility: hidden;
                    position: absolute;
                    left: -10000px;
                    top: -10000px;
                }
            `;
				document.head.appendChild(style);
			}

			// Check for email input fields
			function checkForEmailInput() {
				debug("Waiting for email fields");

				// Select all input elements of type email
				const emailInputs = document.querySelectorAll(EMAIL_FIELD_SELECTOR);
				// Filter out those that are inside .hs-form
				const targetFormEmailInputs = Array.prototype.filter.call(emailInputs, function(input) {
					return !input.closest('.hs-form');
				});

				const emailInput = targetFormEmailInputs.length > 0 ? targetFormEmailInputs[0] : null;
				const hubspotEmailInput = document.querySelector(`form[data-form-id="${formId}"] input[type="email"]`);

				let targetExists = false;
				let hubspotInputExists = false;

				if (emailInput) {
					targetExists = true;
				}

				if (hubspotEmailInput) {
					hubspotInputExists = true;
				}

				if (targetExists && hubspotInputExists) {
					clearInterval(checkInterval); // Stop checking once both elements are detected
					clearInterval(combinedCheckInterval); // Stop the combined interval check
					debug("Found target and hubspot email fields.");
					executeMirroring(emailInput, hubspotEmailInput);
				}
			}

			// Function to be executed when both conditions are true
			function executeMirroring(emailInput, hubSpotEmailInput) {
				debug("Executing mirroring setup");
				// Mirror setup function
				function setupEmailMirroring() {
					// Find the form email input and the HS email input
					debug("Checking inputs...", {hubSpotEmailInput, emailInput}); // Log current status of inputs

					if (emailInput && hubSpotEmailInput) {
						emailInput.addEventListener('input', function(event) {
							hubSpotEmailInput.value = event.target.value; // Mirror the value to the HS field
							debug("Mirroring: ", event.target.value); // Log the mirrored value for debugging
						});

						// Delay setting the initial value to allow HS scripts to finish loading
						setTimeout(function() {
							if (emailInput.value) {
								hubSpotEmailInput.value = emailInput.value;
								debug("Detected initial email value. Added to HS form:", emailInput.value);
							} else {
								debug("Initial email value not found");
							}
						}, 1000); // Delay of 1000ms

						console.log("Real-time email mirroring setup complete.");
						return true;  // Return true if inputs are found and event is set up
					} else {
						debug("emailInput + hubSpotEmailInput not found");
					}
					debug("Email input or HubSpot email input not found for mirroring");
					return true;  // Return false if inputs were not found
				}

				// Function to check for and setup form submission handling
				function setupFormSubmission() {
					debug("Setting up form submission");
					// Select the target form submit button and find the HubSpot form
					
					var targetSubmitButton = document.querySelector(FORM_SUBMIT_BUTTON_SELECTOR);
					var allForms = document.querySelectorAll('form');
					var targetForm = Array.from(allForms).find(form => {
						return form.querySelector(FORM_SUBMIT_BUTTON_SELECTOR) !== null;
					});

					var hubSpotForm = document.querySelector('form.hs-form');
					
					// Check for elements
					function debugElementPresence(element, description) {
						if (element) {
							debug(`Found ${description}: `, element);
						} else {
							debug(`Did not find ${description}.`);
						}
					}
					debugElementPresence(targetSubmitButton, "form submit button");
					debugElementPresence(targetForm, "target form");
					debugElementPresence(hubSpotForm, "HubSpot form");

					if (targetSubmitButton && hubSpotForm) {
						targetSubmitButton.addEventListener('click', function() {
							debug('Target form submit button clicked. Now submitting the HubSpot form.');
							hubSpotForm.submit(); // Trigger the hidden HubSpot form submission
						});
						debug('Form submission setup complete.');
						return true; // Return true if button and form are found and event is set up
					}
					debug('Target submit button or HubSpot form not found');
					return false; // Return false if button or form was not found
				}
				
				targetForm.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                debug('Enter key pressed. Triggering hidden HubSpot form submission.');
                if (hubSpotForm) {
                    hubSpotForm.submit(); // Submit the hidden HubSpot form
                }
            }
        });
				
				targetForm.addEventListener('submit', function() {
            debug('Form submit event triggered. Submitting the hidden HubSpot form.');
            if (hubSpotForm) {
                hubSpotForm.submit(); // Submit the hidden HubSpot form
            }
        });

        debug('Form submission setup complete.');
    }

				// Combined check for both functionalities
				var attempts = 0;
				var maxAttempts = 5;
				var combinedCheckInterval = setInterval(function() {
					var mirrorSetupDone = setupEmailMirroring();
					var formSetupDone = setupFormSubmission();
					if (mirrorSetupDone && formSetupDone) {
						debug("All setups complete.");
						clearInterval(combinedCheckInterval);
					} else {
						debug(`Setup attempt ${attempts + 1} failed`);
						if (!formSetupDone) {
							debug("Form setup not done. Checking variables. ")
						}
					}
					if (++attempts >= maxAttempts) {
						debug("Max attempts reached, stopping checks. Please verify selectors.");
						clearInterval(combinedCheckInterval);
					}
				}, 500);
			}

			// Check for email inputs every 1 second
			const checkInterval = setInterval(checkForEmailInput, 1000);

			// Combined check to stop both intervals if either element is detected
			const combinedCheckInterval = setInterval(checkForEmailInput, 1000);

		})();
	} else {
		console.log("⚠️ Current URL is not in the allowed list, Email Mirroring script will not run.");
	}

})();
