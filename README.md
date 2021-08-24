# request-cache

an elegant way to manage global API requests and associated state.


## features

- full typescript support
- lightweight (0 dependencies)
- standardized approach to API layer
- efficient request caching and state sharing
- simple streamlined API
- support for loading via suspense

## getting started

Creating a RequestCache allows you add any number of actions and stores. You define the API logic and how actions affect different stores at this layer.

```typescript
// api.ts
import {createRequestCache, store} from 'request-cache' // coming soon

const listPosts = store(async () => {
  const posts = fetch(...)
  return posts
})

const createPost = action(async (req, set) => {
  const newPost = fetch(...)
  set('list-posts', (body,prev) => [...prev,newPost])
})

export const [api] = createRequestCache({
  'list-posts': listPosts
  'create-post': createPost
})
```

You can then use your actions and stores inside react to elegantly interact with your API. As a new post is created the logic defined above ensures that `posts` is kept up to date

```tsx
// Posts.tsx
import {api} from './api.ts'

export const Posts = () => {
  const posts = api.use('list-posts')

  return (
    <div>
      <ul>
        {posts.map(post => (
          <li>{post.name}</li>
        ))}
      </ul>
      <button onClick={() => api.do('create-post')}>new post</button>
    </div>
  )
}
```

## why should I use this?

Complexity is opt-in. The API starts very simple, but can be combined in any way to handle very complicated validation.

```typescript
import {object, string, number, array} from 'vnv'

const users = [
  {name: 'John Doe', age: 34, children: ['Ben', 'Lisa']},
  {name: 'Jane Doe', age: 50, children: [true]}
]

const isUserList = array(
  object({
    name: string({min: 5, max: 50}),
    age: number({integer: true}),
    children: array(string())
  })
)

isUserList(users) // ValidationError: [1].children.[0] must be a string
```


## DOCS

_coming soon_