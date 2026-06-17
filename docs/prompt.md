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

-- 
1. cerate a logout api in the backend
2. follow the code structure 
3. the integrate the login, signup and logout api in frontend

---

At first read the /docs of the project carefully to get the full context then
lets create the Create a new workflow part:
1. user will click the create a new session 
2. Then user will get into the create a new session page then user will fill the required fileds then user will click start research button
3. Then we need to at first create a new research session, for this integrate with POST /sessions this api
4. Once the session is created 
   1. In the frontend move to the /sessions/{session_id} page
   2. and start the workflow flow by calling this api POST /sessions/{session_id}/run
5. if you get success message from this api means workflow has been started or show error message in frontend
6. Then poll this api : GET /sessions/{session_id}/status every 5sec to get the current workflow state, as per it update the the ui like Intent parser, Web Searcger the workflow of ui. basically the WorkflowProgressView
7. if this is done then cearet the GET /sessions/{session_id}/report API in backend to get the report and then integrate this api with frontend, once we get the report in fronetnd show the CompleteSessionView

---

Now report generation part is working now our focus is to create a chat with report
it will be websocket based
check the flow
Client                FastAPI (WS route)         ChatService            OpenAI
  │                         │                          │                  │
  │──connect ws+token───────▶                          │                  │
  │                         │──verify JWT──────────────▶                  │
  │                         │──load report from Mongo──▶                  │
  │◀──connection accepted───│                          │                  │
  │                         │                          │                  │
  │──{"message": "..."}────▶                          │                  │
  │                         │──save user msg to Mongo──▶                  │
  │                         │──call chat_service.stream_reply()──────────▶│
  │                         │                          │──stream chunks──▶│
  │◀──token──token──token───│◀─────────────────────────│◀─────────────────│
  │                         │──save assistant msg──────▶                  │
  │◀──{"done": true}────────│                          │                  │


check @docs/db_design2.png to get the new db design

  app/
  ws/
    chat.py              ← the WebSocket route itself (FastAPI endpoint)
  services/
    chat_service.py       ← LLM logic lives here — NOT in the route

check @docs/api_design.md for websocket based api
at first create the backend 
then integarte with frontend
this is talk with the report
report data is in db, for a specific session

--- 
At first get the full context read all the files in docs
The chat part is working perfectly. Few things need to be fixed
1. Once I referesh the page i cant see the old chats of the session, I think any api integration is mission for getting old chats, check @docs/api_design.md for checking the api's. If the api is not cerate then create and then integarte. 
2. In frontend although the chat is working perfectly we are getting response, but I can see a error on top of the chat box `Websoket connection error` remove it
3. Check @api_design if there is any api left to integrate or to be created do it then.
---
Good i can see old chats now, Things to fix now
1. In the frontend there is a download pdf button but it dont work, So make this button work, write the pdf creation logic in frontend, already you are getting all the report data in frontned use that to create a report in pdf format, and make sure user can downlaod it. There are many libarires like react-pdf use the best that suit. 
2. In the top of chat box `Connection lost- please refresh the page` error is comming although it is working perfectly dont show any error there
3. For faild session, it is showing research in progress instead show error message like research faild 
---
read @docs/architecture.md and @docs/requirements.md
## Additional Required Documents

1. `README.md`
2. `architecture.md`
3. `engineering-decisions.md`
4. `product-improvements.md`
I need to create this docs 
one by one 
read old chats for context, I have cerated the application

### `engineering-decisions.md` Must Cover

1. 3 major engineering decisions
2. Alternatives considered
3. Tradeoffs made
4. Top technical debt items
5. Biggest technical risk
6. What you would improve with 2 additional weeks
Lets cover this engineering-desisions

Currently we are using pulling when the workflow is running, the worker is updating the db and we are pulling directly from the db, The best alternatives are instead of using pulling we can use SSE here and instead of pulling from db we can create the arch like there will be redis and user will fetch from redis instead of db
like this can you add 2 more and create engineering decesions file

Show less