I have 2 question 
POST /sessions/{session_id}/run 🔲
GET /sessions/{session_id}/status 🔲

regarding this 2 api's

QS.1
when we call the POST /sessions/{session_id}/run API, the api create's a job in redis and then returns to client
and in the background worker get's the job and run the workflow.
Now when the workflow will run we need to implement checkpointing there so after each node runs the result and status will be saved in db

now what will happen? 

 the sse api will poll from db and return to the clint? 

Qs.2

why not we starting wesocker connection here instead of sse
because after the flow is done we need to start a websocket connection that time so why not before ?


--

Lets now build the frontend 
the  frontend will be quite simple much like claude interface
1. at first a auth page for sign in and sign up
2. then after login user will be redirected to our main page 
3. If user have session created previously then 
4. User will get the create new session page
5. If user have past sessions then a calude like interface we can call this chat page
6. it will hava a simple left navbar where in the top there will be a button to create a new chat
7. then the list of old chats
8. then out side the chat where will be chat interface
9. Now there the user can chat with the report 

The create a new session flow
1. In the create a new session page, there will a form then a button
2. When user will clcik that button(Start Research)
3. The langgraph workflow will start
4. In the time langraph workflow is running we need to pull the startus from a api,
5. And the the frontend we need to show what is happing step by step
6. Then when the startus is done we need to start a websocker connection and start the chat

UI/UX
make it simple and try to use dark theme like claude or chatgpt interface
follow a same design pattern
research around this

Tech Stack
Use react redux toolkit for state management
Then tanstack query for api call
dont try to over complicate things write easy to understand code
try to avoid god components, for complex logic break the components

---

At first read the project carefully
read all the files in docs to know about the projecr
then start with the frontend part
at first just focus on createing the layout no api integartion in this stage, just show me is everything wokring uiux wise